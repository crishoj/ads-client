import ClientError from "../client-error";
import { AdsDataType, AdsDeviceInfo, AdsRawAddress, AdsResponse, AdsState, AdsSymbolInfo, AmsAddress, AmsRouterState, AmsTcpPacket, BaseAdsResponse } from "./ads-protocol-types";

export type DebugLevel = 0 | 1 | 2 | 3;

/**
 * Events for the client, for example `client.on('connect', ...)`
 */
export interface ClientEvents {
  /**
   * Emitted when client has connected to the target
   * 
   * - `connection`: Active connection information
   */
  'connect': [connection: AdsClientConnection],

  /**
   * Emitted when client has disconnected from the target
   * 
   * - `isReconnecting`: True if disconnect happened during reconnecting
   */
  'disconnect': [isReconnecting: boolean],

  /**
   * Emitted when client has reconnected to the target after a disconnection
   * 
   * - `allSubscriptionsRestored`: True if all subscriptions were restored successfully
   * - `unrestoredSubscriptions`: Array of subscription paths that failed to be restored
   */
  'reconnect': [allSubscriptionsRestored: boolean, unrestoredSubscriptions: string[]],

  /**
   * Emitted when client has lost the connection to the target
   * 
   * - `socketFailure`: True if connection was lost due to a socket/tcp problem
   */
  'connectionLost': [socketFailure: boolean],

  /**
   * Emitted when PLC runtime symbol version has changed
   * 
   * - `version`: New PLC runtime symbol version
   * - `previousVersion`: Previous PLC runtime symbol version (if known)
   */
  'plcSymbolVersionChange': [version: number, previousVersion?: number],

  /**
   * Emitted when PLC runtime state has changed
   * 
   * - `state`: New PLC runtime state
   * - `previousState`: Previous PLC runtime state (if known)
   */
  'plcRuntimeStateChange': [state: AdsState, previousState?: AdsState],

  /**
   * Emitted when TwinCAT system state has changed
   * 
   * - `state`: New TwinCAT system state
   * - `previousState`: Previous TwinCAT system state (if known)
   */
  'tcSystemStateChange': [state: AdsState, previousState?: AdsState],

  /**
   * Emitted when AMS router state has changed
   * 
   * - `state`: New AMS router state
   * - `previousState`: Previous AMS router state (if known)
   */
  'routerStateChange': [state: AmsRouterState, previousState?: AmsRouterState],

  /**
   * Emitted when the client has had an error, such as
   *  - unknown ADS notification received
   *  - handling ADS notification failed
   *  - unknown ADS command received
   * 
   * - `error`: Error that was thrown
   */
  'client-error': [error: ClientError]
}

/**
 * Client settings
 */
export interface AdsClientSettings {
  /** 
   * **REQUIRED**: Default target AmsNetId address
   * 
   * Examples:
   * - `localhost` or `127.0.0.1.1.1` - Local (same machine as Node.js)
   * - `192.168.1.5.1.1` - PLC (example)
   * - `192.168.1.5.2.1` - EtherCAT I/O device (example, see also `rawClient` setting) 
   */
  targetAmsNetId: string,

  /** 
   * **REQUIRED**: Default target ADS port
   *  
   * Examples:
   * - `851` - TwinCAT 3 PLC runtime 1
   * - `852` - TwinCAT 3 PLC runtime 2
   * - `801` - TwinCAT 2 PLC runtime 1
   * - `10000` - TwinCAT system service
   * 
   * NOTE: This is not a TCP port (no firewall config needed).
   */
  targetAdsPort: number,

  /** 
   * **Optional**: Target ADS router TCP port (default: `48898`) 
   * 
   * This is usually `48898`, unless using port forwarding (e.g. in docker) or separate TwinCAT router.
   * 
   * NOTE: Router needs to have firewall open for this port, TwinCAT PLC has as default.
   */
  routerTcpPort?: number,

  /** 
   * **Optional**: Target ADS router IP address/hostname (default: `127.0.0.1`) 
   * 
   * This is usually ´127.0.0.1` (local machine), as the TwinCAT system is usually running on the same machine.
   * 
   * However, if connecting from a system without router (such as Linux), this needs to be changed to be the router/PLC address.
   */
  routerAddress?: string,

  /** 
   * **Optional**: Local IP address to use (default: `(empty string)` -> automatic)
   * 
   * Can be used to force using another network interface
   * 
   * See https://nodejs.org/api/net.html#socketconnectoptions-connectlistener
   */
  localAddress?: string,

  /** 
   * **Optional**: Local TCP port to use for outgoing connection (default: `0` -> automatic)
   * 
   * Can be used to force using specific local TCP port for outogoing connection
   * 
   * See https://nodejs.org/api/net.html#socketconnectoptions-connectlistener
   */
  localTcpPort?: number,

  /** 
   * **Optional**: Local AmsNetId to use (default: `(empty string)` -> automatic) 
   * 
   * Can be used to set used AmsNetId manually. If not set, AmsNetId is received from the target router.
   * 
   * This is needed for example when connecting directly to the PLC without local router.
   */
  localAmsNetId?: string,

  /** 
   * **Optional**: Local ADS port to use (default: `0` -> automatic) 
   * 
   * Can be used to set used ADS port manually. If not set, a free ADS port is received from the target router.
  */
  localAdsPort?: number,

  /** 
   * **Optional**: Time (milliseconds) after a command is timeouted if no response received (default: `2000` ms) 
   * 
   * This is used for AMS and ADS commands.
   * 
   * If using a slow connection, it might be useful to increase this limit.
  */
  timeoutDelay?: number,

  /** 
   * **Optional**: If set, the client tries to reconnect automatically after a connection loss (default: `true`) 
   * 
   * The connection loss is detected by
   *  - TCP socket error
   *  - local router state change
   *  - target TwinCAT system state changes (not when `rawClient` setting is set)
   * 
   * NOTE: when using `rawClient` setting, the client might not detect the connection loss
   */
  autoReconnect?: boolean,

  /** 
   * **Optional**: Interval (milliseconds) how often the lost connection is tried to re-establish (default: `2000` ms) 
   * 
   * Value can be lowered if a very fast response if required, however usually getting the connection back on takes a while
   * (TwinCAT system restart takes a while etc.)
   */
  reconnectInterval?: number,

  /** 
   * **Optional**: If set, enumeration (ENUM) data types are converted to objects (default: `true`)
   * 
   * If `true`, ENUM is converted to an object:
   * 
   * ```js
   * {
   *  name: 'enumValue', 
   *  value: 5
   * }
   * ```
   * 
   * If `false`, ENUM is converted to a plain number (`5`)
   */
  objectifyEnumerations?: boolean,

  /** 
   * **Optional**: If set, PLC date types are converted to Javascript `Date` objects (default: `true`)
   * 
   * If `true`, DATE_AND_TIME (DT) and DATE are converted to `Date` objects
   * 
   * If `false`, DATE_AND_TIME (DT) and DATE are converted to numbers (epoch time, seconds)
   */
  convertDatesToJavascript?: boolean,

  /** 
   * **Optional**: If set, all symbols from target are read and cached after connecting. (default: `false`)
   * 
   * This is an intensive operation (symbol data is a large object).
   * 
   * Can be useful when needing a fast response (client already knows all PLC symbol data) - for example 
   * when using subscriptions with high cycle times or when dealing with larger amount of ADS data.
   * 
   * If not set, the client reads and caches symbol information only on demand.
   * 
   * NOTE: This is not available when using the `rawClient` setting.
   */
  readAndCacheSymbols?: boolean,

  /** 
   * **Optional**: If set, all data types from target are read and cached after connecting. (default: `false`)
   * 
   * This is an intensive operation (symbol data is a large object).
   * 
   * Can be useful when needing a fast response (client already knows all PLC datat types) - for example 
   * when using subscriptions with high cycle times or when dealing with larger amount of ADS data.
   * 
   * If not set, the client reads and caches data types only on demand.
   * 
   * NOTE: This is not available when using the `rawClient` setting.
   */
  readAndCacheDataTypes?: boolean,

  /** 
   * **Optional**: If set, client detects target PLC symbol version changes and reloads symbols and data types (default: `true`) 
   * 
   * Symbol version changes when PLC software is updated with download (no online change). By detecting it,
   * the client should work when dealing with a target that has software updated.
   * 
   * NOTE: This is not available when using the `rawClient` setting.
   */
  monitorPlcSymbolVersion?: boolean,

  /** 
   * **Optional**: If set, no warnings are written to console using `console.log()` (default: `false`)
   * 
   * As default, the client writes some warnings to console, such as connection loss and reconnection information.
   * 
   * If set, the client **never** writes anything to console.
   */
  hideConsoleWarnings?: boolean,

  /** 
   * **Optional**: Interval (milliseconds) how often the client checks if the connection if working (default: `1000` ms)
   * 
   * The client checks connection by reading the target TwinCAT system state.
   * 
   * See setting `connectionDownDelay`.
   * 
   * NOTE: This is not available when using the `rawClient` setting.
   */
  connectionCheckInterval?: number,

  /** 
   * **Optional**: Time (milliseconds) how long after the target TwinCAT system state is not available, the connection is determined to be lost (default: `5000` ms) 
   *    * 
   * See setting `connectionCheckInterval`.
   * 
   * NOTE: This is not available when using the `rawClient` setting.
   */
  connectionDownDelay?: number,

  /** 
   * **Optional**: If set, connecting to the target will success, even if there is no PLC runtime available or if the target TwinCAT system is in CONFIG mode (default: `false`)
   * 
   * This can be useful if the target might not yet have a PLC software downloaded when connecting and client needs to be connected in advance.
   */
  allowHalfOpen?: boolean,

  /** 
   * **Optional**: If set, only a direct raw ADS connection is established to the target (default: `false`) 
   * 
   * As default, the client always assumes the target has a TwinCAT system and a PLC runtime.
   * 
   * However, in some cases only a direct ADS communication is required or a better choice:
   *  - connecting directly to I/O terminals by ADS
   *  - conneting to non-TwinCAT systems (such as custom ADS server - see https://github.com/jisotalo/ads-server)
   *  - connecting to TwinCAT system only (without PLC)
   */
  rawClient?: boolean,

  /** 
   * **Optional**: If set, the client never caches symbols and data types (default: `false`) 
   * 
   * If set, the client always reads data type and symbol information from target.
   * This slows the communication but guarantees up-to-date data in all cases.
   * 
   * As default, the client caches the results after reading them from the target.
   */
  disableCaching?: boolean
}

/**
 * Internal timer object to keep the timer state saved
 */
export interface TimerObject {
  /** Timer ID */
  id: number,
  /** Timer handle */
  timer?: NodeJS.Timeout
}

/**
 * Active client connection
 */
export interface AdsClientConnection {
  /** Connection status of the client, true if connected */
  connected: boolean,
  /** True if connected to local TwinCAT system (loopback)*/
  isLocal?: boolean,
  /** Local AmsNetId of the client */
  localAmsNetId?: string,
  /** Local ADS port of the client */
  localAdsPort?: number,
  /** Target AmsNetId */
  targetAmsNetId?: string,
  /** Target ADS port */
  targetAdsPort?: number,
}

/** 
 * Object containing all active subscriptions for each target address
 * 
 * Target address (`amsNetId:port`) is used as a key
 */
export interface ActiveSubscriptionContainer {
  [K: string]: TargetActiveSubscriptionContainer
}

/** 
 * Object containing all active subscriptions for each notification handle (for one target)
 * 
 * Notification handle is used as a key
 */
export interface TargetActiveSubscriptionContainer {
  [K: number]: ActiveSubscription
}

/** 
 * Object containing information for a single active subscription 
 */
export interface ActiveSubscription<T = any> {
  /** Settings for this subscription */
  settings: SubscriptionSettings<T>,
  /** True = This subscription is ads-client internal, not created by user */
  internal: boolean,
  /** Remote AMS address and port */
  remoteAddress: AmsAddress,
  /** Notification handle (number) of this subscription's ADS device notification */
  notificationHandle: number,
  /** Symbol info of the target variable (if any) */
  symbolInfo?: AdsSymbolInfo,
  /** Function that can be called to unsubscribe (same as `client.unsubscribe(...)`) */
  unsubscribe: () => Promise<void>,
  /** Function that parses received raw data to a variable */
  parseNotification: (data: Buffer, timestamp: Date) => Promise<SubscriptionData<T>>,
  /** Latest data that has been received (if any) */
  latestData?: SubscriptionData<T>,
  /** Optional target settings that override values in `settings` (NOTE: If used, no caching is available -> worse performance) */
  targetOpts?: Partial<AmsAddress>
}

/**
 * Subscription data (value and timestamp)
 */
export interface SubscriptionData<T = any> {
  timestamp: Date,
  value: T
}

/** 
 * Object containing all active ADS requests that are waiting for responses 
 * 
 * Invoke ID is used as a key
 */
export interface ActiveAdsRequestContainer {
  [K: number]: ActiveAdsRequest
}

/**
 * Active ADS command that is waiting for answer
 * Callback is called when response is received
 */
export interface ActiveAdsRequest {
  timeoutTimerHandle?: NodeJS.Timeout,
  responseCallback: (packet: AmsTcpPacket<AdsResponse>) => void
};

/**
 * Client connection metadata
 */
export interface ConnectionMetaData {
  /** Target device information (if available) */
  deviceInfo?: AdsDeviceInfo,
  /** Target TwinCAT system state (if available) */
  tcSystemState?: AdsState,
  /** Target PLC runtime state (if available) */
  plcRuntimeState?: AdsState,
  /** Target PLC runtime symbol and datatype count/size information (if available) */
  uploadInfo?: AdsUploadInfo,
  /** Target PLC runtime symbol version (if available) */
  plcSymbolVersion?: number,
  /** Set to `true` if client has cached all symbols */
  allSymbolsCached: boolean,
  /** Cached target PLC runtime symbols (if available) */
  symbols: AdsSymbolInfoContainer,
  /** Set to `true` if client has cached all data types */
  allDataTypesCached: boolean,
  /** Cached target PLC runtime data types without subitems (if available) */
  dataTypes: AdsDataTypeContainer,
  /** Local AMS router state (if available) */
  routerState?: AmsRouterState
};

/**
 * PLC runtime upload info
 * 
 * Contains information about symbols and data types
 */
export interface AdsUploadInfo {
  /** Number of symbols in the target runtime */
  symbolCount: number,
  /** Length of downloadable symbol description data (bytes) */
  symbolLength: number,
  /** Number of datatypes in the target runtime */
  dataTypeCount: number,
  /** Length of downloadable data type description data (bytes) */
  dataTypeLength: number,
  /** Unknown */
  extraCount: number,
  /** Unknown */
  extraLength: number
}

/**
 * Object containing PLC runtime symbol information objects
 */
export interface AdsSymbolInfoContainer {
  [K: string]: AdsSymbolInfo
}

/**
 * Object containing PLC runtime data type objects
 */
export interface AdsDataTypeContainer {
  [K: string]: AdsDataType
}

/**
 * ADS command  
 */
export interface AdsCommandToSend {
  /** Ads command (see `ADS.ADS_COMMAND`)*/
  adsCommand: number,
  /** Target AmsNetId (receiver) */
  targetAmsNetId?: string,
  /** Target ADS port (receiver) */
  targetAdsPort?: number
  /** Payload data */
  payload?: Buffer
}

/**
 * Represents a callback function used in a subscription.
 * 
 * @template T - The type of data being passed to the callback
 * 
 * @param data - The data received
 * @param subscription - The active subscription object
 */
export type SubscriptionCallback<T = any> = (data: SubscriptionData<T>, subscription: ActiveSubscription<T>) => void;

/**
 * Settings for a subscription
 */
export interface SubscriptionSettings<T = any> {
  /** 
   * Subscription target (variable name as string or raw ADS address). 
   * 
   * Such as such as `GVL_Test.ExampleStruct` or `{indexGroup, indexOffset, size}` object 
   */
  target: AdsRawAddress | string,

  /** Callback function that is called when new value is received */
  callback: SubscriptionCallback<T>,

  /** 
   * Cycle time for subscription (default: `200 ms`)
   * 
   * If `sendOnChange` is `true` (default), PLC checks if value has changed with `cycleTime` interval. 
   * If the value has changed, a new value is sent.
   * 
   * If `sendOnChange` is `false`, PLC constantly sends the value with `cycleTime` interval. 
   */
  cycleTime?: number,

  /** Should the notification be sent only when the value changes? (default: `true`)
   * 
   * If `false`, the value is sent with `cycleTime` interval (even if it doesn't change).
   * 
   * If `true` (default), the value is checked every `cycleTime` and sent only if it has changed.
   * 
   * NOTE: When subscribing, the value is always sent once.
   */
  sendOnChange?: boolean,

  /** 
   * How long the PLC waits before sending the values at maximum? (default: `0` ms --> maximum delay is off)
   * 
   * If value is not changing, the first notification with active value after subscribing is sent after `maxDelay`.
   * 
   * If the value is changing, the PLC sends one or more notifications every `maxDelay`. 
   * 
   * So if `cycleTime` is 100 ms, `maxDelay` is 1000 ms and value changes every 100 ms, the PLC sends 10 notifications every 1000 ms.
   * This can be useful for throttling.
   */
  maxDelay?: number,
}

/**
 * PLC primitive types (not structs, function blocks etc.)
 */
export type PlcPrimitiveType = string | boolean | number | Buffer | Date | BigInt;

/**
 * Return value of `readSymbol()`
 * 
 * @template T - Type of the value
 */
export interface ReadSymbolResult<T = any> {
  /** Value of the symbol as converted Javascript object */
  value: T,
  /** Raw value as Buffer */
  rawValue: Buffer,
  /** Data type of the target symbol */
  dataType: AdsDataType,
  /** Symbol information of the target symbol */
  symbolInfo: AdsSymbolInfo
}

/**
 * Return value of `writeSymbol()`
 */
export interface WriteSymbolResult<T = any> {
  /** Value of the symbol as converted Javascript object */
  value: T,
  /** Raw value as Buffer */
  rawValue: Buffer,
  /** Data type of the target symbol */
  dataType: AdsDataType,
  /** Symbol information of the target symbol */
  symbolInfo: AdsSymbolInfo
}

/** 
 * Return value of `convertObjectToBuffer()` 
 */
export interface ObjectToBufferConversionResult {
  /** Converted raw value */
  rawValue: Buffer,
  /** Property key name, if a property is missing from the Javascript object */
  missingProperty?: string
}

/**
 * Variable handle object created using `createVariableHandle()` or `createVariableHandleMulti()`
 */
export interface VariableHandle {
  /** Handle number */
  handle: number,
  /** Data type size */
  size: number,
  /** Unknown */
  typeDecoration: number,
  /** Data type name */
  dataType: string
}

/**
 * Return value of `invokeRpcMethod()`
 * 
 * @template T The type of method return value
 * @template U The type of method outputs
 */
export interface RpcMethodCallResult<T = any, U = Record<string, any>> {
  /** Method return value (if any - `undefined` if none) */
  returnValue?: T,
  /** Method outputs (if any - `{}` if none)*/
  outputs: U
}

/**
 * Parameter containing all read commands for `readRawMulti()`
 */
export interface ReadRawMultiCommand extends Required<AdsRawAddress> { }

/**
 * Return value of `readRawMulti()`
 */
export interface ReadRawMultiResult extends BaseAdsResponse {
  /** Command */
  command: ReadRawMultiCommand,
  /** True if reading was successful */
  success: boolean,
  /** Value (if any) */
  value?: Buffer
}

/**
 * Parameter containing all write commands for `writeRawMulti()`
 */
export interface WriteRawMultiCommand extends AdsRawAddress {
  /** Value to write */
  value: Buffer,
  /** Size (bytes) - optional - as default, size of value is used*/
  size?: number
}

/**
 * Return value of `writeRawMulti()`
 */
export interface WriteRawMultiResult extends BaseAdsResponse {
  /** Command */
  command: WriteRawMultiCommand,
  /** True if writing was successful */
  success: boolean
}

/**
 * Return value of `createVariableHandleMulti()`
 */
export interface CreateVariableHandleMultiResult extends BaseAdsResponse {
  /** Full variable path in the PLC (such as `GVL_Test.ExampleStruct`) */
  path: string,
  /** True if handle was created successfully */
  success: boolean,
  /** Created handle (if any) */
  handle?: VariableHandle
}

/**
 * Return value of `deleteVariableHandleMulti()`
 */
export interface DeleteVariableHandleMultiResult extends BaseAdsResponse {
  /** Variable handle */
  handle: VariableHandle | number,
  /** True if handle was deleted successfully */
  success: boolean
}

/**
 * Parameter containing all read/write commands for `readWriteRawMulti()`
 */
export interface ReadWriteRawMultiCommand extends Required<AdsRawAddress> {
  /** Data to write */
  writeData: Buffer,
  /** How many bytes to read */
  size: number
}

/**
 * Return value of `readWriteRawMulti()`
 */
export interface ReadWriteRawMultiResult extends BaseAdsResponse {
  /** Command */
  command: ReadWriteRawMultiCommand,
  /** True if command was successful */
  success: boolean,
  /** Response data (if any) */
  data?: Buffer,
}