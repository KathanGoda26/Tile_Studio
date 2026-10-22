import {mkdir,writeFile,rename,readdir,access} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),local=path.join(root,'.local');
const version='8.0.34',url=`https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-${version}.zip`;
const expected='6b021a0864494e4decf278b36477a29eb36072432773e4e62c2f42c302630db0';
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('This installer supports Windows x64. Install MongoDB Community for your operating system.');
await mkdir(local,{recursive:true});const zip=path.join(local,'mongodb.zip');
const cached=await access(zip).then(()=>true,()=>false);
if(!cached){console.log(`Downloading MongoDB Community ${version} from mongodb.org…`);const response=await fetch(url);if(!response.ok)throw new Error(`Download failed (${response.status}).`);await pipeline(Readable.fromWeb(response.body),createWriteStream(zip+'.partial'))}
else console.log('Verifying the cached MongoDB archive…');
const hash=createHash('sha256');for await(const chunk of createReadStream(cached?zip:zip+'.partial'))hash.update(chunk);
if(hash.digest('hex')!==expected)throw new Error('MongoDB archive checksum does not match. Installation stopped.');
if(!cached)await rename(zip+'.partial',zip);
const destination=path.join(local,'mongodb');await mkdir(destination,{recursive:true});
await promisify(execFile)('tar.exe',['-xf',zip,'-C',destination],{windowsHide:true});
const candidates=[];
for(const entry of await readdir(destination,{withFileTypes:true}))if(entry.isDirectory()){
 const candidate=path.join(destination,entry.name,'bin','mongod.exe');
 if(await access(candidate).then(()=>true,()=>false))candidates.push(candidate);
}
if(candidates.length!==1)throw new Error('Expected exactly one MongoDB executable after extraction.');
const executable=candidates[0];
await writeFile(path.join(local,'mongodb-runtime.json'),JSON.stringify({version,executable},null,2));
console.log('MongoDB installed inside .local. Run npm run db:start.');
