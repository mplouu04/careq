-- SQL aggregation for queue metrics hot paths (avg service time + daily history).

CREATE OR REPLACE FUNCTION public.get_avg_service_minutes(
  p_day_start TIMESTAMPTZ,
  p_day_end TIMESTAMPTZ
) RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (completed_at - called_at)) / 60.0
      )
    )::INT,
    10
  )
  FROM queue
  WHERE status = 'completed'
    AND called_at IS NOT NULL
    AND completed_at IS NOT NULL
    AND called_at >= p_day_start
    AND called_at <= p_day_end;
$$;

CREATE OR REPLACE FUNCTION public.get_queue_served_by_day(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
) RETURNS TABLE(day DATE, served BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (completed_at AT TIME ZONE 'Asia/Manila')::DATE AS day,
    COUNT(*)::BIGINT AS served
  FROM queue
  WHERE status = 'completed'
    AND completed_at IS NOT NULL
    AND completed_at >= p_start
    AND completed_at < p_end
  GROUP BY 1
  ORDER BY 1;
$$;
