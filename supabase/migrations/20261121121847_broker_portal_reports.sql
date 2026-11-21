-- Report PDFs are filed by the trusted worker. Reads go through super admin and
-- use short-lived signed URLs. No public Storage policies are granted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('broker-portal-reports','broker-portal-reports',false,10485760,array['application/pdf']);
