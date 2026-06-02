import { Hono } from 'npm:hono';
import fna from './advice-engine-fna-routes.ts';
import ina from './advice-engine-ina-routes.ts';
import ai from './advice-engine-ai-routes.ts';
import roa from './advice-engine-roa-routes.ts';

const app = new Hono();

app.route('/', fna);
app.route('/', ina);
app.route('/', ai);
app.route('/', roa);

export default app;
