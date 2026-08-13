import Combine
import SwiftUI
import WebKit

@MainActor
final class BrowserModel: NSObject, ObservableObject {
    static let homeURL = URL(string: "https://www.casaforteerechim.app.br/")!

    @Published var canGoBack = false
    @Published var isLoading = true
    @Published var progress = 0.0
    @Published var hasError = false

    weak var webView: WKWebView?

    func attach(_ webView: WKWebView) {
        self.webView = webView
    }

    func goHome() {
        webView?.load(URLRequest(url: Self.homeURL))
    }

    func goBack() {
        guard let webView, webView.canGoBack else { return }
        webView.goBack()
    }

    func reload() {
        hasError = false
        if webView?.url == nil {
            goHome()
        } else {
            webView?.reload()
        }
    }

}
