import {readFile,access} from 'node:fs/promises';
import {readConfig} from '../src/config.js';
import {connectDatabase} from '../src/database.js';
import {seedCatalog} from './seed.js';
const rooms=JSON.parse(await readFile(new URL('../data/photo-rooms.json',import.meta.url),'utf8'));
const missing=[];
for(const room of rooms){try{await access(new URL('../../frontend/public'+room.image,import.meta.url))}catch{missing.push(room.file)}}
if(missing.length){console.error('Copy these photos into frontend/public/assets/rooms first:\n'+missing.join('\n'));process.exitCode=1;}
else {let connection;try{connection=await connectDatabase(readConfig());const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));console.log('Photo rooms imported:',await seedCatalog(connection.db,{...catalog,rooms}));}finally{await connection?.client.close()}}
