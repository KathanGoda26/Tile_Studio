import {MongoClient} from 'mongodb';
export async function connectDatabase(config){
 const client=new MongoClient(config.uri,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,maxPoolSize:10});
 try{await client.connect();const db=client.db(config.database);await db.command({ping:1});return {client,db}}catch(error){await client.close();throw error}
}
