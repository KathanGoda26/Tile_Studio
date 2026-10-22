import {createServer} from 'node:http';
// Reserve the port before opening MongoDB or starting generation-job recovery.
export async function startBackend(config,{connectDatabase,createApp}){
 let app,connection;
 const server=createServer((req,res)=>{
  if(app)return app(req,res);
  res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Server is starting. Please try again.'}));
 });
 try{
  await new Promise((resolve,reject)=>{
   const onError=error=>{server.off('listening',onListen);reject(error);};
   const onListen=()=>{server.off('error',onError);resolve();};
   server.once('error',onError);server.once('listening',onListen);server.listen(config.port,config.host);
  });
  connection=await connectDatabase(config);
  app=createApp(connection.db);
 }catch(error){
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await connection?.client.close().catch(()=>{});
  throw error;
 }
 let closing;
 return {server,close:()=>closing??=(async()=>{
  await new Promise(resolve=>server.close(resolve));
  await connection.client.close();
 })()};
}
