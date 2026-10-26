import {readConfig} from '../backend/src/config.js';
import {connectDatabase} from '../backend/src/database.js';
import {createApp} from '../backend/src/app.js';

let application;
async function getApplication(){
 if(!application){
  application=connectDatabase(readConfig()).then(({db})=>createApp(db)).catch(error=>{application=undefined;throw error;});
 }
 return application;
}

export default async function handler(req,res){
 try{return (await getApplication())(req,res);}
 catch{res.status(503).json({error:'Database connection unavailable. Please try again.'});}
}
