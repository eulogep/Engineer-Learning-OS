// On-device OCR for scanned PDFs (macOS Vision + PDFKit). Prints JSON:
// {"pages":[{"pageNumber":1,"text":"..."}]}. No network; used by mcp/elos-server.ts.
import Foundation
import PDFKit
import Vision

guard CommandLine.arguments.count == 2, let document = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
  FileHandle.standardError.write("usage: elos-ocr <file.pdf>\n".data(using: .utf8)!)
  exit(2)
}

var pages: [[String: Any]] = []
for index in 0..<document.pageCount {
  guard let page = document.page(at: index) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2.0
  let width = Int(bounds.width * scale), height = Int(bounds.height * scale)
  guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }
  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: context)
  guard let image = context.makeImage() else { continue }

  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = ["fr-FR", "en-US"]
  request.usesLanguageCorrection = true
  try? VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
  let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
  pages.append(["pageNumber": index + 1, "text": lines.joined(separator: "\n")])
}
let data = try JSONSerialization.data(withJSONObject: ["pages": pages])
FileHandle.standardOutput.write(data)
