const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('query_sql', { query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'courses'" }).catch(() => ({}));
  if (data) console.log(data);
  // fallback if rpc is not there
  const res = await supabase.from('courses').select('*').limit(1);
  console.log(Object.keys(res.data[0] || {}));
}
run();
