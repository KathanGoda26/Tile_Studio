import {readConfig} from '../src/config.js';
import {connectDatabase} from '../src/database.js';
let connection;try{connection=await connectDatabase(readConfig());console.log({database:'connected',rooms:await connection.db.collection('rooms').countDocuments(),tiles:await connection.db.collection('tiles').countDocuments()})}catch{console.error('MongoDB is not reachable. Start it using npm run db:start.');process.exitCode=1}finally{await connection?.client.close()}
