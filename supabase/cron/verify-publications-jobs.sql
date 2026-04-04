-- Verify Navigate Wealth publications cron jobs and recent runs

select
  jobid,
  jobname,
  schedule,
  active,
  command
from cron.job
where jobname in (
  'publications-process-scheduled',
  'publications-process-notification-jobs'
)
order by jobname;

select
  j.jobname,
  r.jobid,
  r.runid,
  r.status,
  r.return_message,
  r.start_time,
  r.end_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname in (
  'publications-process-scheduled',
  'publications-process-notification-jobs'
)
order by r.start_time desc
limit 20;
