import test from 'node:test';import assert from 'node:assert/strict';import {readConfig} from '../src/config.js';
test('Invalid ports and malformed connection settings fail early',()=>{for(const env of [{PORT:'abc'},{PORT:'0'},{PORT:'70000'},{MONGODB_URI:'https://example.com'},{MONGODB_DB:'../other'}])assert.throws(()=>readConfig(env))});
test('Default configuration connects only to local MongoDB',()=>{const c=readConfig({});assert.equal(c.uri,'mongodb://127.0.0.1:27017');assert.equal(c.host,'127.0.0.1');assert.equal(c.database,'tile_studio')});
