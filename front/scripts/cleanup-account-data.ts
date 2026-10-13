import "dotenv/config";
import { purgeExpiredAccountData } from "../src/lib/account-retention";
import { db } from "../src/lib/db";
try { console.log(JSON.stringify(await purgeExpiredAccountData())); }
finally { await db().$disconnect(); }
