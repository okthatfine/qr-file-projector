// A list of frame numbers alone cannot distinguish versions or block widths.
// The copyable repair ticket binds those numbers to the sender's exact layout.
///|
priv struct RepairTicket {
  hash : String
  length : Int32
  width : Int32
  ranges : String
}

///|
pub fn make_ticket(session : Transfer) -> String {
  guard session.file is Some(file) else { return "" }
  let ranges = missing_ranges(session)
  guard ranges != "" else { return "" }
  "QFR1:\{file.hash}:\{file.length}:\{file.width}:\{ranges}"
}

///|
priv suberror TicketError {
  TicketError(String)
}

///|
fn decimal_field(
  field : StringView,
  maximum : Int32,
) -> Int32 raise TicketError {
  guard field.length() > 0 && field.length() <= 5 else {
    raise TicketError("补播凭条中的数字长度不正确")
  }
  let mut number = 0
  for ch in field {
    guard ch >= '0' && ch <= '9' else {
      raise TicketError("补播凭条中出现非十进制字符")
    }
    number = number * 10 + ch.to_int() - '0'.to_int()
    guard number <= maximum else {
      raise TicketError("补播凭条中的数值超限")
    }
  }
  number
}

///|
fn parse_ticket(text : String) -> RepairTicket raise TicketError {
  guard text.length() <= 6200 else { raise TicketError("补播凭条过长") }
  let fields = text.split(":").collect()
  guard fields.length() == 5 && fields[0] == "QFR1" else {
    raise TicketError("无法识别补播凭条的格式")
  }
  let hash = fields[1].to_owned()
  guard valid_hash(hash) else {
    raise TicketError("补播凭条中的摘要格式不正确")
  }
  let length = decimal_field(fields[2], 65536)
  let width = decimal_field(fields[3], 512)
  guard width >= 64 else {
    raise TicketError("补播凭条的块宽超出范围")
  }
  let ranges = fields[4].trim().to_owned()
  guard ranges != "" else {
    raise TicketError("补播凭条未包含缺块清单")
  }
  { hash, length, width, ranges, }
}

///|
fn replay_selection(
  request : String,
  hash : String,
  length : Int32,
  width : Int32,
  emit : (Int32) -> Unit,
) -> String {
  let text = request.trim().to_owned()
  let total = chunk_count(length, width)
  if !text.contains(":") {
    return choose_frames(total, text, emit)
  }
  let ticket = parse_ticket(text) catch {
    TicketError(message) => return message
  }
  guard ticket.hash == hash && ticket.length == length else {
    return "补播凭条对应另一份文件，请选择原文件"
  }
  guard ticket.width == width else {
    return "请把每块字节数改为 \{ticket.width} 后再补播"
  }
  choose_frames(total, ticket.ranges, emit)
}
