import * as events from 'events'
import { PeerPool } from '../net/peerpool'
import { Peer } from '../net/peer/peer'
import { Config } from '../config'

const defaultOptions = {
  maxPeers: 25,
  servers: [],
}

/**
 * Base class for all services
 * @memberof module:service
 */
export class Service extends events.EventEmitter {
  public config: Config

  public opened: boolean
  public running: boolean
  public servers: any
  public pool: any

  /**
   * Create new service and associated peer pool
   * @param {Object}     options constructor parameters
   * @param {Server[]}   [options.servers=[]] servers to run service on
   * @param {number}     [options.maxPeers=25] maximum peers allowed
   */
  constructor(options?: any) {
    super()

    this.config = new Config()

    options = { ...defaultOptions, ...options }
    this.opened = false
    this.running = false
    this.servers = options.servers
    this.pool = new PeerPool({
      servers: this.servers,
      maxPeers: options.maxPeers,
    })
    this.pool.on('message', async (message: any, protocol: string, peer: Peer) => {
      if (this.running) {
        try {
          await this.handle(message, protocol, peer)
        } catch (error) {
          this.config.logger.debug(
            `Error handling message (${protocol}:${message.name}): ${error.message}`
          )
        }
      }
    })
  }

  /**
   * Service name
   * @protected
   * @type {string}
   */
  get name(): any {
    return ''
    //throw new Error('Unimplemented')
  }

  /**
   * Returns all protocols required by this service
   * @type {Protocol[]} required protocols
   */
  get protocols(): any {
    return []
  }

  /**
   * Open service. Must be called before service is running
   * @return {Promise}
   */
  async open() {
    if (this.opened) {
      return false
    }
    const protocols = this.protocols
    this.servers.map((s: any) => s.addProtocols(protocols))
    if (this.pool) {
      this.pool.on('banned', (peer: Peer) => this.config.logger.debug(`Peer banned: ${peer}`))
      this.pool.on('error', (error: Error) => this.emit('error', error))
      this.pool.on('added', (peer: Peer) => this.config.logger.debug(`Peer added: ${peer}`))
      this.pool.on('removed', (peer: Peer) => this.config.logger.debug(`Peer removed: ${peer}`))
      await this.pool.open()
    }
    this.opened = true
  }

  /**
   * Close service.
   * @return {Promise}
   */
  async close() {
    if (this.pool) {
      this.pool.removeAllListeners()
      await this.pool.close()
    }
    this.opened = false
  }

  /**
   * Start service
   * @return {Promise}
   */
  async start(): Promise<void | boolean> {
    if (this.running) {
      return false
    }
    await Promise.all(this.servers.map((s: any) => s.start()))
    this.running = true
    this.config.logger.info(`Started ${this.name} service.`)
  }

  /**
   * Stop service
   * @return {Promise}
   */
  async stop(): Promise<void | boolean> {
    if (this.opened) {
      await this.close()
    }
    this.running = false
    this.config.logger.info(`Stopped ${this.name} service.`)
  }

  /**
   * Handles incoming request from connected peer
   * @param  {Object}  message message object
   * @param  {string}  protocol protocol name
   * @param  {Peer}    peer peer
   * @return {Promise}
   */
  async handle(_message: any, _protocol: string, _peer: Peer): Promise<any> {}
}
