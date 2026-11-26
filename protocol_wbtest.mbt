///|
test "last chunk and empty transfer" {
  assert_eq(chunk_count(513, 256), 3)
  assert_eq(chunk_start(513, 256, 2), 512)
  assert_eq(chunk_end(513, 256, 2), 513)
  assert_eq(chunk_end(513, 256, 3), -1)
  assert_eq(chunk_end(0, 256, 0), 0)
}

///|
test "out of order, repeated and conflicting observations" {
  let c = new_collector(3)
  assert_eq(receive_frame(c, 2, "C"), 1)
  assert_eq(receive_frame(c, 2, "C"), 1)
  assert_eq(receive_frame(c, 2, "X"), -1)
  assert_eq(receive_frame(c, 0, "A"), 2)
  assert_eq(receive_frame(c, 1, "B"), 3)
  assert_eq(frame_at(c, 2), "C")
}

///|
test "only validated frames reach the receiver" {
  let digest = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
  let delivered = []
  let receive = fn(_hash, name, _length, _width, index, _payload, total) {
    delivered.push((name, index, total))
  }
  let last = write_wire(digest, "课程.txt", 65, 64, 1, "YQ==")
  assert_eq(read_wire(last, receive), "")
  assert_eq(delivered.length(), 1)
  assert_eq(delivered[0], ("课程.txt", 1, 2))
  let damaged = write_wire(digest, "课程.txt", 65, 64, 1, "YWI=")
  assert_eq(read_wire(damaged, receive), "无效数据块")
  assert_eq(delivered.length(), 1)
}
