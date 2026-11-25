///|
// An empty file still has a frame so its identity can be sent.
pub fn chunk_count(length : Int32, width : Int32) -> Int32 {
  if length < 0 || length > 65536 || width < 1 || width > 512 {
    return 0
  }
  if length == 0 {
    1
  } else {
    1 + (length - 1) / width
  }
}

///|
pub fn chunk_start(length : Int32, width : Int32, index : Int32) -> Int32 {
  if index < 0 || index >= chunk_count(length, width) {
    -1
  } else {
    index * width
  }
}

///|
pub fn chunk_end(length : Int32, width : Int32, index : Int32) -> Int32 {
  let start = chunk_start(length, width, index)
  if start < 0 {
    -1
  } else if start + width > length {
    length
  } else {
    start + width
  }
}

///|
test "last chunk and empty transfer" {
  assert_eq(chunk_count(513, 256), 3)
  assert_eq(chunk_start(513, 256, 2), 512)
  assert_eq(chunk_end(513, 256, 2), 513)
  assert_eq(chunk_end(513, 256, 3), -1)
  assert_eq(chunk_end(0, 256, 0), 0)
}
