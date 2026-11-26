// GIF89a with one global palette. Index 0 is white, index 1 is black.
// QR images never need a local palette, transparency or partial updates.
///|
pub struct Animation {
  priv output : Array[Byte]
  priv size : Int32
  priv delay : Int32
  priv mut frames : Int32
}

///|
fn append_word(out : Array[Byte], value : Int32) -> Unit {
  out.push((value & 255).to_byte())
  out.push(((value >> 8) & 255).to_byte())
}

///|
fn append_bytes(out : Array[Byte], bytes : Bytes) -> Unit {
  for byte in bytes {
    out.push(byte)
  }
}

///|
pub fn new_animation(side : Int32, delay_cs : Int32) -> Animation {
  let out = []
  let valid = side > 0 && side <= 512 && delay_cs >= 1 && delay_cs <= 65535
  let size = if valid { side } else { 0 }
  if valid {
    append_bytes(out, b"GIF89a")
    append_word(out, size)
    append_word(out, size)
    // Global table, two colours, background = white, no pixel aspect ratio.
    append_bytes(out, b"\x80\x00\x00\xff\xff\xff\x00\x00\x00")
    // NETSCAPE application extension, repeat indefinitely.
    append_bytes(out, b"\x21\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00")
  }
  { output: out, size, delay: delay_cs, frames: 0, }
}

///|
priv struct GifBits {
  block : Array[Byte]
  out : Array[Byte]
  mut bits : Int32
  mut occupied : Int32
}

///|
fn GifBits::flush_block(self : GifBits) -> Unit {
  if self.block.length() > 0 {
    self.out.push(self.block.length().to_byte())
    for byte in self.block {
      self.out.push(byte)
    }
    self.block.clear()
  }
}

///|
fn GifBits::byte(self : GifBits, value : Int32) -> Unit {
  self.block.push(value.to_byte())
  if self.block.length() == 255 {
    self.flush_block()
  }
}

///|
fn GifBits::code(self : GifBits, value : Int32, width : Int32) -> Unit {
  self.bits = self.bits | (value << self.occupied)
  self.occupied += width
  while self.occupied >= 8 {
    self.byte(self.bits & 255)
    self.bits = self.bits >> 8
    self.occupied -= 8
  }
}

///|
fn GifBits::finish(self : GifBits) -> Unit {
  if self.occupied > 0 {
    self.byte(self.bits & 255)
  }
  self.flush_block()
  self.out.push(0)
}

// Code widths follow the reader's dictionary, which lags the writer by one
// entry. Keeping that counter separate also handles the final end code.

///|
priv struct LzwWriter {
  bits : GifBits
  table : Map[Int32, Int32]
  mut prefix : Int32
  mut next : Int32
  mut reader_next : Int32
  mut width : Int32
  mut first : Bool
}

///|
fn LzwWriter::reset(self : LzwWriter) -> Unit {
  self.table.clear()
  self.next = 6
  self.reader_next = 6
  self.width = 3
  self.first = true
}

///|
fn LzwWriter::emit_prefix(self : LzwWriter) -> Unit {
  self.bits.code(self.prefix, self.width)
  if self.first {
    self.first = false
  } else if self.reader_next < 4096 {
    self.reader_next += 1
    if self.width < 12 && self.reader_next == 1 << self.width {
      self.width += 1
    }
  }
}

///|
fn LzwWriter::pixel(self : LzwWriter, shade : Int32) -> Unit {
  if self.prefix < 0 {
    self.prefix = shade
    return
  }
  let key = self.prefix * 2 + shade
  match self.table.get(key) {
    Some(code) => self.prefix = code
    None => {
      self.emit_prefix()
      if self.next == 4096 {
        self.bits.code(4, self.width)
        self.reset()
      } else {
        self.table[key] = self.next
        self.next += 1
      }
      self.prefix = shade
    }
  }
}

///|
pub fn append_qr(
  animation : Animation,
  modules : Bytes,
  width : Int32,
  scale : Int32,
) -> String {
  let side = animation.size
  guard side > 0 else { return "GIF 尺寸或帧间隔无效" }
  guard animation.frames < 1024 else { return "GIF 帧数过多" }
  guard width >= 21 && width <= 177 && (width - 21) % 4 == 0 else {
    return "二维码矩阵宽度无效"
  }
  guard scale >= 1 && scale <= 8 && (width + 8) * scale <= side else {
    return "画布无法容纳二维码及留白"
  }
  guard modules.length() == width * width else {
    return "二维码矩阵不完整"
  }
  for byte in modules {
    guard byte <= 1 else { return "二维码矩阵含非黑白像素" }
  }
  let out = animation.output
  append_bytes(out, b"\x21\xf9\x04\x04")
  append_word(out, animation.delay)
  append_bytes(out, b"\x00\x00\x2c")
  append_word(out, 0)
  append_word(out, 0)
  append_word(out, side)
  append_word(out, side)
  append_bytes(out, b"\x00\x02")
  let bits = { block: [], out, bits: 0, occupied: 0, }
  let writer : LzwWriter = {
    bits,
    table: {},
    prefix: -1,
    next: 6,
    reader_next: 6,
    width: 3,
    first: true,
  }
  bits.code(4, 3)
  let origin = (side - width * scale) / 2
  let edge = origin + width * scale
  for y in 0..<side {
    for x in 0..<side {
      let shade = if x >= origin && x < edge && y >= origin && y < edge {
        let i = (y - origin) / scale * width + (x - origin) / scale
        modules[i].to_int()
      } else {
        0
      }
      writer.pixel(shade)
    }
  }
  writer.emit_prefix()
  bits.code(5, writer.width)
  bits.finish()
  animation.frames += 1
  ""
}

///|
pub fn animation_bytes(animation : Animation) -> Bytes {
  guard animation.frames > 0 else { return b"" }
  // Finalization is idempotent; the caller may append another frame later.
  Bytes::makei(animation.output.length() + 1, fn(i) {
    if i == animation.output.length() {
      0x3b
    } else {
      animation.output[i]
    }
  })
}
