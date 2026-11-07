// Supabase Edge Function: stripe-webhook
// Configure the Stripe webhook endpoint to this function URL.
// Required function secret: STRIPE_WEBHOOK_SECRET.
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const signature = req.headers.get('stripe-signature');
  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey || !signature) {
    return new Response('Webhook is not configured', { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const cryptoProvider = Stripe.createSubtleCryptoProvider();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (_error) {
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const session = event.data.object as Stripe.Checkout.Session;
  const contributionId = session.metadata?.contribution_id;
  if (!contributionId) return new Response('Missing contribution reference', { status: 400 });

  if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
    const { error } = await supabase.from('contributions')
      .update({ payment_status: 'confirmed', confirmed_at: new Date().toISOString(), provider_reference: session.id })
      .eq('id', contributionId)
      .eq('payment_provider', 'stripe');
    if (error) return new Response('Could not update contribution', { status: 500 });
  } else if (event.type === 'checkout.session.expired') {
    const { error } = await supabase.from('contributions')
      .update({ payment_status: 'cancelled' })
      .eq('id', contributionId)
      .eq('payment_provider', 'stripe')
      .eq('payment_status', 'pending');
    if (error) return new Response('Could not update expired contribution', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
