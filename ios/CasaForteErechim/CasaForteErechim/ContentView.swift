import SwiftUI

struct ContentView: View {
    @StateObject private var browser = BrowserModel()

    var body: some View {
        ZStack(alignment: .top) {
            Color(red: 0.035, green: 0.043, blue: 0.039)
                .ignoresSafeArea()

            WebView(model: browser)
                .ignoresSafeArea(.container, edges: .bottom)

            if browser.isLoading {
                ProgressView(value: browser.progress)
                    .progressViewStyle(.linear)
                    .tint(Color(red: 0.96, green: 0.76, blue: 0.20))
                    .background(Color.white.opacity(0.08))
            }

            if browser.hasError {
                ConnectionErrorView {
                    browser.reload()
                }
            }

            if browser.canGoBack && !browser.hasError {
                Button {
                    browser.goBack()
                } label: {
                    Image(systemName: "chevron.backward")
                        .font(.system(size: 17, weight: .bold))
                        .frame(width: 42, height: 42)
                }
                .accessibilityLabel("Voltar")
                .foregroundStyle(Color(red: 0.96, green: 0.76, blue: 0.20))
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.16), lineWidth: 1))
                .shadow(color: .black.opacity(0.28), radius: 10, y: 4)
                .padding(.top, 8)
                .padding(.leading, 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
    }
}

private struct ConnectionErrorView: View {
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 46, weight: .medium))
                .foregroundStyle(Color(red: 0.96, green: 0.76, blue: 0.20))
            Text("Não foi possível abrir a Casa Forte")
                .font(.title3.bold())
                .multilineTextAlignment(.center)
            Text("Confira sua conexão com a internet e tente novamente.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Tentar novamente", action: retry)
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.96, green: 0.76, blue: 0.20))
                .foregroundStyle(.black)
        }
        .padding(28)
        .frame(maxWidth: 360)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
