import lmdb from 'node-lmdb'

export interface GunNode {
  _: {
    '#': string
    '>': {
      [key: string]: number
    }
    [key: string]: any
  }
  [key: string]: any
}

export interface GunPut {
  [soul: string]: GunNode
}

const DEFAULT_CONFIG = {
  path: 'lmdb'
}

export class GunLmdbClient {
  Gun: any
  env: any
  dbi: any

  constructor(Gun: any, lmdbConfig = DEFAULT_CONFIG) {
    this.Gun = Gun
    this.env = new lmdb.Env()
    this.env.open(lmdbConfig)
    this.dbi = this.env.openDbi({
      name: 'gun-nodes',
      create: true
    })
  }

  async get(soul: string) {
    if (!soul) return null
    const txn = this.env.beginTxn()
    try {
      const data = txn.getString(this.dbi, soul)
      txn.commit()
      return this.deserialize(data)
    } catch (e) {
      txn.abort()
      throw e
    }
  }

  async read(soul: string) {
    const data = await this.get(soul)
    if (!data) return

    if (!this.Gun.SEA || soul.indexOf('~') === -1) return data

    for (let key in data) {
      if (key === '_') continue
      this.Gun.SEA.verify(
        this.Gun.SEA.opt.pack(data[key], key, data, soul),
        false,
        (res: GunNode) => (data[key] = this.Gun.SEA.opt.unpack(res, key, data))
      )
    }

    return data
  }

  serialize(node: GunNode) {
    return JSON.stringify(node)
  }

  deserialize(data: string) {
    return JSON.parse(data)
  }

  async writeNode(soul: string, nodeData: GunNode) {
    if (!soul) return
    const txn = this.env.beginTxn()
    const nodeDataMeta = (nodeData && nodeData['_']) || {}
    const nodeDataState = nodeDataMeta['>'] || {}

    try {
      const existingData = txn.getString(this.dbi, soul)
      const node = this.deserialize(existingData) || {}
      const meta = (node['_'] = node['_'] || { '#': soul, '>': {} })
      const state = (meta['>'] = meta['>'] || {})

      for (let key in nodeData) {
        if (key === '_' || !(key in nodeDataState)) continue
        node[key] = nodeData[key]
        state[key] = nodeDataState[key]
      }

      txn.putString(this.dbi, soul, this.serialize(node))
      txn.commit()
    } catch (e) {
      txn.abort()
      throw e
    }
  }

  async write(put: GunPut) {
    if (!put) return
    for (let soul in put) await this.writeNode(soul, put[soul])
  }

  close() {
    this.dbi.close()
    this.env.close()
  }
}

export function createClient(Gun: any, options: any) {
  return new GunLmdbClient(Gun, options)
}
