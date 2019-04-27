import { GunLmdbClient, GunPut } from './client'

interface GunGet {
  '#': string
  get: {
    '#': string
  }
}

export const attachToGun = (Gun: any, options?: any) =>
  Gun.on('create', function(this: any, db: any) {
    const lmdb = (Gun.lmdb = db.lmdb = new GunLmdbClient(Gun, options))

    db.on('get', async function(this: any, request: GunGet) {
      this.to.next(request)
      if (!request) return
      const dedupId = request['#']
      const get = request.get
      const soul = get['#']

      try {
        const result = await lmdb.get(soul)
        db.on('in', {
          '@': dedupId,
          put: result ? { [soul]: result } : null,
          err: null
        })
      } catch (err) {
        console.error('error', err.stack || err)
        db.on('in', {
          '@': dedupId,
          put: null,
          err
        })
      }
    })

    db.on('put', async function(this: any, request: GunPut) {
      if (!request) return this.to.next(request)
      const dedupId = request['#']

      try {
        await lmdb.write(request.put)
        db.on('in', {
          '@': dedupId,
          ok: true,
          err: null
        })
      } catch (err) {
        db.on('in', {
          '@': dedupId,
          ok: false,
          err: err
        })
      }

      this.to.next(request)
    })

    this.to.next(db)
  })
