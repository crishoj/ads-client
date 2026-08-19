/**
 * Tests for metadata reset on disconnect.
 *
 * The cached symbols and data types in `metaData` must not survive a disconnect:
 * after a PLC code download the cached memory layout is stale, and reusing it makes
 * the client decode notifications with the old offsets/sizes without any error.
 *
 * Runs standalone - no PLC connection needed.
 *
 * Run: npx jest test/metadata-reset.test.js
 */
const { Client } = require('../dist/ads-client');

const newClient = () => new Client({
  targetAmsNetId: '192.168.4.1.1.1',
  targetAdsPort: 851
});

/** Fills the metadata caches with entries, as an active connection would */
const fillCaches = (client) => {
  client.metaData.plcSymbols['gvl_test.stalesymbol'] = { name: 'GVL_Test.StaleSymbol' };
  client.metaData.plcDataTypes['st_stale'] = { name: 'ST_Stale' };
  client.metaData.builtDataTypes['st_stale'] = { name: 'ST_Stale' };
  client.metaData.allPlcSymbolsCached = true;
  client.metaData.allPlcDataTypesCached = true;
  client.metaData.plcSymbolVersion = 1;
};

const cacheKeys = (client) => ({
  plcSymbols: Object.keys(client.metaData.plcSymbols),
  plcDataTypes: Object.keys(client.metaData.plcDataTypes),
  builtDataTypes: Object.keys(client.metaData.builtDataTypes)
});

describe('metadata reset', () => {

  test('caches are empty for a new client', () => {
    expect(cacheKeys(newClient())).toStrictEqual({
      plcSymbols: [],
      plcDataTypes: [],
      builtDataTypes: []
    });
  });

  test('caches are emptied by disconnecting', async () => {
    const client = newClient();
    fillCaches(client);

    //Forced disconnect - there is no socket or connection to close
    await client.disconnectFromTarget(true, false);

    expect(cacheKeys(client)).toStrictEqual({
      plcSymbols: [],
      plcDataTypes: [],
      builtDataTypes: []
    });
    expect(client.metaData.allPlcSymbolsCached).toBe(false);
    expect(client.metaData.allPlcDataTypesCached).toBe(false);
    expect(client.metaData.plcSymbolVersion).toBe(undefined);
  });

  test('caches are new objects after disconnecting (not the previous ones emptied)', async () => {
    const client = newClient();
    const before = { ...client.metaData };

    await client.disconnectFromTarget(true, false);

    expect(client.metaData.plcSymbols).not.toBe(before.plcSymbols);
    expect(client.metaData.plcDataTypes).not.toBe(before.plcDataTypes);
    expect(client.metaData.builtDataTypes).not.toBe(before.builtDataTypes);
  });

  test('filling the caches does not affect the next disconnect', async () => {
    const client = newClient();

    //If the reset aliased shared objects, the first disconnect would leak entries
    //into them and the second client/disconnect would start out polluted
    fillCaches(client);
    await client.disconnectFromTarget(true, false);
    fillCaches(client);
    await client.disconnectFromTarget(true, false);

    expect(cacheKeys(client)).toStrictEqual({
      plcSymbols: [],
      plcDataTypes: [],
      builtDataTypes: []
    });
    expect(cacheKeys(newClient())).toStrictEqual({
      plcSymbols: [],
      plcDataTypes: [],
      builtDataTypes: []
    });
  });
});
