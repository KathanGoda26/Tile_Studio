import {mkdir,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),local=path.join(root,'.local');
let runtime;try{runtime=JSON.parse(await readFile(path.join(local,'mongodb-runtime.json'),'utf8'))}catch{console.error('Run npm run db:install first, or start your existing MongoDB installation.');process.exit(1)}
await mkdir(path.join(local,'mongodb-data'),{recursive:true});
const child=spawn(runtime.executable,['--dbpath',path.join(local,'mongodb-data'),'--bind_ip','127.0.0.1','--port','27017','--logpath',path.join(local,'mongodb.log'),'--logappend'],{stdio:'inherit',windowsHide:true});
console.log('Starting local MongoDB at 127.0.0.1:27017. Keep this terminal open. Log: .local/mongodb.log');
child.on('error',()=>{console.error('Could not launch MongoDB. Run npm run db:install.');process.exitCode=1});
child.on('exit',code=>{process.exitCode=code||0});
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
