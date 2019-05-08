import { GunLmdbClient, GunNode } from './client'

export const respondToGets = (
  Gun: any,
  { disableRelay = true, skipValidation = true } = {},
  lmdbOpts = undefined
) => (db: any) => {
  const lmdb = (Gun.lmdb = db.lmdb = new GunLmdbClient(Gun, lmdbOpts))

  db.onIn(async function gunLmdbRespondToGets(msg: any) {
    const { from, json, fromCluster } = msg
    const get = json && json.get
    const soul = get && get['#']
    const dedupId = (json && json['#']) || ''

    if (!soul || fromCluster) return msg

    try {
      // const result = await lmdb.get(soul)
      const rawResult = await lmdb.getRaw(soul)
      let put = 'null'
      if (rawResult) {
        put = ['{', `${JSON.stringify(soul)}: ${rawResult}`, '}'].join('')
      }
      const raw: string = [
        '{',
        `"#": ${JSON.stringify(from.msgId())},`,
        `"@": ${JSON.stringify(from.msgId())},`,
        `"put": ${put}`,
        '}'
      ].join('')
      /*
      const json = {
        '#': from.msgId(),
        '@': dedupId,
        put: result ? { [soul]: result } : null
      }
      */

      from.send({
        raw,
        // json,
        ignoreLeeching: true,
        skipValidation: !rawResult || skipValidation
      })

      return disableRelay && rawResult ? { ...msg, noRelay: true } : msg
    } catch (err) {
      const json = {
        '#': from.msgId(),
        '@': dedupId,
        err: `${err}`
      }

      from.send({ json, ignoreLeeching: true, skipValidation })
      return msg
    }
  })

  return db
}

export const acceptWrites = (Gun: any, { disableRelay = false } = {}, lmdbOpts = undefined) => (
  db: any
) => {
  const lmdb = (Gun.lmdb = db.lmdb = new GunLmdbClient(Gun, lmdbOpts))

  db.onIn(async function gunLmdbAcceptWrites(msg: any) {
    if (msg.fromCluster || !msg.json.put) return msg
    const diff: GunNode = await db.getDiff(msg.json.put)
    const souls = diff && Object.keys(diff)

    if (!souls || !souls.length) {
      return disableRelay ? { ...msg, noRelay: true } : msg
    }

    try {
      await lmdb.write(diff)
      const json = { '@': msg.json['#'], ok: true, err: null }

      msg.from &&
        msg.from.send &&
        msg.from.send({
          json,
          noRelay: true,
          ignoreLeeching: true,
          skipValidation: true
        })
      return msg
    } catch (err) {
      console.error('error writing data', err)
      const json = { '@': msg.json['#'], ok: false, err: `${err}` }

      msg.from &&
        msg.from.send &&
        msg.from.send({
          json,
          noRelay: disableRelay,
          ignoreLeeching: true,
          skipValidation: true
        })

      return msg
    }
  })

  return db
}
