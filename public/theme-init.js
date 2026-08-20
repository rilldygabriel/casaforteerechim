try {
  var casaForteTheme = localStorage.getItem("casa-forte-theme");
  if (
    casaForteTheme !== "light" &&
    casaForteTheme !== "dark" &&
    casaForteTheme !== "editorial"
  ) {
    casaForteTheme = "dark";
  }

  var casaForteIsLight = casaForteTheme !== "dark";
  document.documentElement.dataset.theme = casaForteIsLight ? "light" : "dark";
  if (casaForteTheme === "editorial") {
    document.documentElement.dataset.palette = "editorial";
  } else {
    delete document.documentElement.dataset.palette;
  }
  document.documentElement.style.colorScheme = casaForteIsLight ? "light" : "dark";
} catch (error) {
  document.documentElement.dataset.theme = "dark";
  delete document.documentElement.dataset.palette;
}
