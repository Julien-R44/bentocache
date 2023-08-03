// import { test } from '@japa/runner'
// import { BaseDriver } from '../src/drivers/base_driver.js'

// test.group('Base Driver', (group) => {
//   test('Duplicates colon should be removed', ({ assert }) => {
//     class MyDriver extends BaseDriver {
//       getPrefix() {
//         return super.getPrefix()
//       }
//     }

//     assert.equal(new MyDriver({ prefix: 'test:::', ttl: 100 }).getPrefix(), 'test:')
//     assert.equal(new MyDriver({ prefix: ':::test:::', ttl: 100 }).getPrefix(), 'test:')
//   })

//   test('getItemKey should remove duplicate colons', ({ assert }) => {
//     class MyDriver extends BaseDriver {
//       getItemKey(key: string) {
//         return super.getItemKey(key)
//       }
//     }

//     const driver = new MyDriver({ prefix: 'test:::', ttl: 100 })
//     console.log(driver.getItemKey(':::test::'), 'test:test')
//   })
// })
