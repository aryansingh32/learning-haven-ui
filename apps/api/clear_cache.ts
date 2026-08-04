import redis from './src/config/redis';

async function run() {
  await redis.del('courses:list:false');
  await redis.del('courses:list:true');
  console.log('Cache cleared');
  process.exit(0);
}
run();
