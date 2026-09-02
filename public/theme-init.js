try {
  var casaForteTheme = localStorage.getItem("casa-forte-theme");
  if (casaForteTheme === "light" || casaForteTheme === "editorial") {
    casaForteTheme = "navy";
    localStorage.setItem("casa-forte-theme", casaForteTheme);
  }
  if (
    casaForteTheme !== "dark" &&
    casaForteTheme !== "navy" &&
    casaForteTheme !== "heritage"
  ) {
    casaForteTheme = "dark";
  }

  var casaForteIsLight = casaForteTheme !== "dark";
  document.documentElement.dataset.theme = casaForteIsLight ? "light" : "dark";
  if (casaForteIsLight) {
    document.documentElement.dataset.palette = casaForteTheme;
  } else {
    delete document.documentElement.dataset.palette;
  }
  document.documentElement.style.colorScheme = casaForteIsLight ? "light" : "dark";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      casaForteTheme === "heritage" ? "#f6f1e9" : casaForteIsLight ? "#f6f3ed" : "#080908",
    );
} catch (error) {
  document.documentElement.dataset.theme = "dark";
  delete document.documentElement.dataset.palette;
}
