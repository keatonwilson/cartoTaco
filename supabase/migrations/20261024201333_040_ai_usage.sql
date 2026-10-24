-- 040: AI concierge usage
--
-- One row per signed-in user per Tucson day. /api/agent reads today's row to
-- enforce the daily token budget, and records each answered query through
-- record_ai_usage() once the concierge has run.
--
-- Users can only read their own rows and can only add to them (negative
-- numbers are clamped), so the worst a user can do through the API is use up
-- their own budget. The global monthly ceiling is the Anthropic workspace
-- spend limit, not this table.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day           date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Phoenix')::date,
  requests      integer NOT NULL DEFAULT 0,
  input_tokens  bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  escalations   integer NOT NULL DEFAULT 0,
  cost_usd      numeric(12, 6) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI usage" ON public.ai_usage;
CREATE POLICY "Users can view own AI usage"
  ON public.ai_usage FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.ai_usage TO authenticated;

-- Add one answered query to the caller's row for today and return the totals
CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_escalated boolean,
  p_cost_usd numeric
) RETURNS public.ai_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.ai_usage;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'record_ai_usage needs a signed-in user';
  END IF;

  INSERT INTO public.ai_usage AS u (user_id, requests, input_tokens, output_tokens, escalations, cost_usd)
  VALUES (
    auth.uid(), 1,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    CASE WHEN p_escalated THEN 1 ELSE 0 END,
    greatest(coalesce(p_cost_usd, 0), 0)
  )
  ON CONFLICT (user_id, day) DO UPDATE SET
    requests      = u.requests + 1,
    input_tokens  = u.input_tokens + EXCLUDED.input_tokens,
    output_tokens = u.output_tokens + EXCLUDED.output_tokens,
    escalations   = u.escalations + EXCLUDED.escalations,
    cost_usd      = u.cost_usd + EXCLUDED.cost_usd
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_usage(bigint, bigint, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(bigint, bigint, boolean, numeric) TO authenticated;

COMMENT ON TABLE public.ai_usage IS 'AI concierge usage per user per Tucson day; written by record_ai_usage() from /api/agent.';
