// Supabase Edge Function: create-stripe-checkout
// Deploy with Supabase CLI. Set STRIPE_SECRET_KEY and SITE_URL as function secrets.
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const siteUrl = Deno.env.get('SITE_URL');
  const origin = req.headers.get('origin');
  if (!siteUrl || origin !== siteUrl) return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: corsHeaders });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeKey || !supabaseUrl || !serviceKey) return Response.json({ error: 'Payment service is not configured' }, { status: 503, headers: corsHeaders });

  let payload: { amount?: number; displayName?: string; publishConsent?: boolean };
  try { payload = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders }); }

  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
    return Response.json({ error: 'Amount must be between 1 and 100,000 EUR in whole euros' }, { status: 400, headers: corsHeaders });
  }

  const publishConsent = payload.publishConsent === true;
  const displayName = publishConsent && typeof payload.displayName === 'string'
    ? payload.displayName.trim().slice(0, 80) || null
    : null;

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: contribution, error: insertError } = await supabase
    .from('contributions')
    .insert({
      amount,
      payment_provider: 'stripe',
      payment_status: 'pending',
      display_name: displayName,
      publish_consent: publishConsent && Boolean(displayName),
    })
    .select('id')
    .single();

  if (insertError || !contribution) {
    return Response.json({ error: 'Could not create contribution record' }, { status: 500, headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(stripeKey);
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amount * 100,
          product_data: { name: 'Freiwillige Unterstützung – Mein Weg zum Millionär' },
        },
      }],
      metadata: { contribution_id: contribution.id },
      success_url: siteUrl + '/?payment=success',
      cancel_url: siteUrl + '/?payment=cancelled',
    });

    await supabase.from('contributions')
      .update({ provider_reference: checkout.id })
      .eq('id', contribution.id);

    return Response.json({ url: checkout.url }, { headers: corsHeaders });
  } catch (_error) {
    await supabase.from('contributions').delete().eq('id', contribution.id);
    return Response.json({ error: 'Stripe Checkout could not be created' }, { status: 502, headers: corsHeaders });
  }
});
