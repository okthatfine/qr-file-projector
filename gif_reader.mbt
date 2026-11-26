// Stream frames into the QR recognizer. Only the full-frame black-and-white
// profile produced by the projector is supported, to bound memory and time.
///|
priv suberror GifError {
  GifError(String)
}

///|
priv struct Cursor {
  data : Bytes
  mut pos : Int32
}

///|
fn Cursor::take(self : Cursor) -> Int32 raise GifError {
  guard self.pos < self.data.length() else {
    raise GifError("GIF 意外截断")
  }
  let value = self.data[self.pos].to_int()
  self.pos += 1
  value
}

///|
fn Cursor::word(self : Cursor) -> Int32 raise GifError {
  let low = self.take()
  let high = self.take()
  low | (high << 8)
}

///|
fn Cursor::skip(self : Cursor, size : Int32) -> Unit raise GifError {
  guard size <= self.data.length() - self.pos else {
    raise GifError("GIF 数据块越界")
  }
  self.pos += size
}

///|
fn Cursor::signature(self : Cursor, expected : Bytes) -> Unit raise GifError {
  for byte in expected {
    guard self.take() == byte.to_int() else {
      raise GifError("不支持的 GIF 格式")
    }
  }
}

///|
fn Cursor::skip_blocks(self : Cursor) -> Unit raise GifError {
  for ;; {
    let size = self.take()
    if size == 0 {
      break
    }
    self.skip(size)
  }
}

///|
priv struct CodeReader {
  source : Cursor
  mut buffered : Int32
  mut available : Int32
  mut left : Int32
}

///|
fn CodeReader::next(self : CodeReader, width : Int32) -> Int32 raise GifError {
  while self.available < width {
    if self.left == 0 {
      self.left = self.source.take()
      guard self.left > 0 else { raise GifError("GIF 帧缺少结束码") }
    }
    let byte = self.source.take()
    self.left -= 1
    self.buffered = self.buffered | (byte << self.available)
    self.available += 8
  }
  let code = self.buffered & ((1 << width) - 1)
  self.buffered = self.buffered >> width
  self.available -= width
  code
}

///|
fn unpack_image(source : Cursor, pixels : Int32) -> Bytes raise GifError {
  guard source.take() == 2 else { raise GifError("仅支持双色放映 GIF") }
  let input : CodeReader = { source, buffered: 0, available: 0, left: 0, }
  let parents = FixedArray::make(4096, -1)
  let tails : FixedArray[Byte] = FixedArray::make(4096, 0)
  let reverse : Array[Byte] = []
  let output : Array[Byte] = Array(capacity=pixels)
  let mut next = 6
  let mut width = 3
  let mut previous = -1
  let mut first_pixel : Byte = 0
  guard input.next(width) == 4 else { raise GifError("GIF 帧缺少清除码") }
  for ;; {
    let code = input.next(width)
    if code == 5 {
      break
    }
    if code == 4 {
      next = 6
      width = 3
      previous = -1
      continue
    }
    guard code <= next && (code < next || previous >= 0) else {
      raise GifError("GIF 压缩码尚未定义")
    }
    let mut walk = code
    reverse.clear()
    if code == next {
      reverse.push(first_pixel)
      walk = previous
    }
    while walk >= 6 {
      reverse.push(tails[walk])
      walk = parents[walk]
    }
    guard walk == 0 || walk == 1 else {
      raise GifError("GIF 像素超出调色板")
    }
    first_pixel = walk.to_byte()
    reverse.push(first_pixel)
    guard reverse.length() <= pixels - output.length() else {
      raise GifError("解压后的像素多于画布容量")
    }
    for i = reverse.length() - 1; i >= 0; i = i - 1 {
      output.push(reverse[i])
    }
    if previous >= 0 && next < 4096 {
      parents[next] = previous
      tails[next] = first_pixel
      next += 1
      if width < 12 && next == 1 << width {
        width += 1
      }
    }
    previous = code
  }
  guard output.length() == pixels else { raise GifError("GIF 帧像素不足") }
  source.skip(input.left)
  source.skip_blocks()
  Bytes::from_array(output)
}

///|
fn visit_animation(
  data : Bytes,
  visit : (Int32, Bytes) -> Unit,
) -> Unit raise GifError {
  guard data.length() <= 32 * 1024 * 1024 else {
    raise GifError("GIF 文件过大")
  }
  let source = { data, pos: 0, }
  source.signature(b"GIF89a")
  let side = source.word()
  let height = source.word()
  guard side >= 29 && side <= 512 && height == side else {
    raise GifError("仅支持文件放映机的方形画布")
  }
  source.signature(b"\x80\x00\x00\xff\xff\xff\x00\x00\x00")
  let mut count = 0
  for ;; {
    match source.take() {
      0x3b => {
        guard count > 0 && source.pos == data.length() else {
          raise GifError("GIF 结尾无效")
        }
        break
      }
      0x21 => {
        let _label = source.take()
        source.skip_blocks()
      }
      0x2c => {
        guard count < 1024 && (count + 1) * side * side <= 160000000 else {
          raise GifError("GIF 解码工作量超限")
        }
        let left = source.word()
        let top = source.word()
        let width = source.word()
        let frame_height = source.word()
        let flags = source.take()
        guard left == 0 &&
          top == 0 &&
          width == side &&
          frame_height == side &&
          flags == 0 else {
          raise GifError("仅支持完整画布的非交错帧")
        }
        let shades = unpack_image(source, side * side)
        visit(side, shades)
        count += 1
      }
      _ => raise GifError("无法识别 GIF 数据块")
    }
  }
}

///|
pub fn read_animation(data : Bytes, visit : (Int32, Bytes) -> Unit) -> String {
  visit_animation(data, visit) catch {
    GifError(message) => return message
  }
  ""
}
