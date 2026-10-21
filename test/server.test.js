const test = require('node:test')
const assert = require('node:assert/strict')
const app = require('../server')

test('GET / returns the application status', async () => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      status: 200,
      message: 'hello world changing'
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
