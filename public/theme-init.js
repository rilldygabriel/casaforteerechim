try {
  var casaForteTheme = localStorage.getItem("casa-forte-theme");
  if (casaForteTheme === "light" || casaForteTheme === "editorial") {
    casaForteTheme = "navy";
    localStorage.setItem("casa-forte-theme", casaForteTheme);
  }
  if (casaForteTheme !== "dark" && casaForteTheme !== "navy") {
    casaForteTheme = "dark";
  }

  var casaForteIsLight = casaForteTheme === "navy";
  document.documentElement.dataset.theme = casaForteIsLight ? "light" : "dark";
  if (casaForteTheme === "navy") {
    document.documentElement.dataset.palette = "navy";
  } else {
    delete document.documentElement.dataset.palette;
  }
  document.documentElement.style.colorScheme = casaForteIsLight ? "light" : "dark";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", casaForteIsLight ? "#f6f3ed" : "#080908");
} catch (error) {
  document.documentElement.dataset.theme = "dark";
  delete document.documentElement.dataset.palette;
}
