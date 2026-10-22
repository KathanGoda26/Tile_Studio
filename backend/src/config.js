import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
export function readConfig(env=process.env){
 const port=Number(env.PORT||3002),uri=env.MONGODB_URI||'mongodb://127.0.0.1:27017',database=env.MONGODB_DB||'tile_studio';
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer between 1 and 65535.');
 if(!/^mongodb(?:\+srv)?:\/\//.test(uri))throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://.');
 if(!/^[a-zA-Z0-9_-]+$/.test(database))throw new Error('MONGODB_DB must contain only letters, numbers, underscores or hyphens.');
 return {port,host:env.HOST||'127.0.0.1',uri,database};
}
