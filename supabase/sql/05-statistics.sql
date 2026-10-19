-- Owner-only SQL Editor queries. Never expose these queries as public views/RPCs.
-- Exact outcomes preserve combinations, e.g. ["ACT","SAVE"].
select result_type,count(*) as submissions
from public.research_submissions group by result_type order by submissions desc;
-- Seven labels: mixed records count once for EACH listed label; totals can exceed N.
select label,count(*) as appearances from public.research_submissions
cross join lateral jsonb_array_elements_text(result_type) labels(label)
group by label order by appearances desc;
-- Raw dimension sums and aggregate share of all raw points (not average person share).
with totals as (
 select dim,sum(value::numeric) as points from public.research_submissions
 cross join lateral jsonb_each_text(scores) s(dim,value) group by dim
)
select dim,points,round(100*points/nullif(sum(points) over(),0),2) as overall_point_share from totals;
-- Per-question option frequencies. Multi-choice options each count once.
select question,option,count(*) as picks from public.research_submissions
cross join lateral jsonb_each(answers) a(question,choices)
cross join lateral jsonb_array_elements_text(choices) b(option)
group by question,option order by question,option;
-- Combinations are canonical dataset order, including one-item choices.
select question,choices,count(*) as submissions from public.research_submissions
cross join lateral jsonb_each(answers) a(question,choices)
where question in ('Q9','Q10','Q13') group by question,choices order by question,submissions desc;
