// JXA / 系统 AppKit：读取剪贴板图片，不修改剪贴板，不依赖额外安装的工具。
ObjC.import('AppKit');
function run(args) {
  var image = $.NSImage.alloc.initWithPasteboard($.NSPasteboard.generalPasteboard);
  if (!image || image.isNil()) return 'no-image';
  var bitmap = $.NSBitmapImageRep.imageRepWithData(image.TIFFRepresentation);
  if (!bitmap || bitmap.isNil()) return 'no-image';
  var png = bitmap.representationUsingTypeProperties($.NSPNGFileType, $({}));
  if (!png.writeToFileAtomically($(args[0]), true)) throw new Error('Could not read clipboard image');
  return 'ok';
}
