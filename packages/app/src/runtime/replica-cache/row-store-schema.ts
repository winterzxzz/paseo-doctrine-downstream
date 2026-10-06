// 2: agent rows carry Foundation receipts (roleBinding, launchContract, ...). Version 1 rows
// lack them and a changes-only sync never resends unchanged agents, so they must be wiped.
export const REPLICA_ROW_STORE_SCHEMA_VERSION = 2;

export const REPLICA_SINGLETON_ROW_ID = "singleton";
