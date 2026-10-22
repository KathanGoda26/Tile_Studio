import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readConfig} from '../src/config.js';
import {connectDatabase} from '../src/database.js';
export async function seedCatalog(db,catalog){
 for(const name of ['rooms','tiles','metadata'])await db.collection(name).createIndex({id:1},{unique:true});
 for(const name of ['rooms','tiles'])await db.collection(name).bulkWrite(catalog[name].map(item=>({updateOne:{filter:{id:item.id},update:{$set:item},upsert:true}})));
 await db.collection('metadata').updateOne({id:'catalog'},{$set:{collection:catalog.collection}},{upsert:true});
 return {rooms:await db.collection('rooms').countDocuments(),tiles:await db.collection('tiles').countDocuments()};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let connection;try{connection=await connectDatabase(readConfig());const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));console.log('Catalogue imported:',await seedCatalog(connection.db,catalog))}catch{console.error('Import failed. Check MongoDB and backend/data/catalog.json.');process.exitCode=1}finally{await connection?.client.close()}
}
