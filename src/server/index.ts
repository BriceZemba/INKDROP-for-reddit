import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { forge } from './routes/forge';
import { profile } from './routes/profile';
import { notify } from './routes/notify';
import { campaign } from './routes/campaign';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';
import { scheduler } from './routes/scheduler';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/triggers', triggers);
internal.route('/scheduler', scheduler);

app.route('/api', api);
app.route('/api/forge', forge);
app.route('/api/profile', profile);
app.route('/api/notify', notify);
app.route('/api/campaign', campaign);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
