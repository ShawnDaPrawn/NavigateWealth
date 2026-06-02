import { Hono } from 'npm:hono';
import dashboard from './compliance-dashboard-routes.ts';
import faisAml from './compliance-fais-aml-routes.ts';
import popia from './compliance-popia-routes.ts';
import regulatory from './compliance-regulatory-routes.ts';
import documents from './compliance-documents-routes.ts';
import conduct from './compliance-conduct-routes.ts';

const app = new Hono();

app.route('/', dashboard);
app.route('/', faisAml);
app.route('/', popia);
app.route('/', regulatory);
app.route('/', documents);
app.route('/', conduct);

export default app;
