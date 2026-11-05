# Bibliography

These pages rest on the works below, and the plugin rests on the two services credited ahead of them.

## Credits

[Weather data by Open-Meteo.com](https://open-meteo.com/), offered under [Attribution 4.0 International (CC BY 4.0)](https://open-meteo.com/en/licence). Open-Meteo's forecast API serves every forecast the plugin reads and the forecast behind this site's sample day, and its geocoding API serves each result of the settings page's location search.[^zippenfenig2023]

Location data from [GeoNames](https://www.geonames.org/), offered under Creative Commons Attribution 4.0. GeoNames is the source of the geocoding results that search shows.[^geonames]

## Works

- [The Clear-Sky Curve](./clear-sky.md) is the sun illuminance model of U.S. Naval Observatory Circular 171.[^janiczek1987]
- [The Clear-Sky Curve](./clear-sky.md) is also checked against the cases the suite of the [`skylight`](https://cran.r-project.org/package=skylight) package pins, and this paper is the citation that package gives.[^hufkens2023]
- [The Cloud Factor](./cloud-factor.md) divides by the Haurwitz clear-sky model, with the constants of this Sandia report.[^reno2012]
- [The Sun's Altitude](./altitude.md) is held to the Solar Position Algorithm of this report.[^reda2008]

[^zippenfenig2023]: Zippenfenig. 2023. "Open-Meteo.com Weather API." Zenodo. <https://doi.org/10.5281/zenodo.7970649>

[^geonames]: GeoNames. 2026. "GeoNames Gazetteer." GeoNames. <https://www.geonames.org/>

[^janiczek1987]: Janiczek and DeYoung. 1987. "Computer Programs for Sun and Moon Illuminance With Contingent Tables and Diagrams." U.S. Naval Observatory, Circular 171. <https://archive.org/details/DTIC_ADA182110>

[^hufkens2023]: Hufkens et al. 2023. "Evaluating the effects of moonlight on the vertical flight profiles of three western palaearctic swifts." *Proceedings of the Royal Society B* 290 (2010): 20230957. <https://doi.org/10.1098/rspb.2023.0957>

[^reno2012]: Reno, Hansen, and Stein. 2012. "Global Horizontal Irradiance Clear Sky Models: Implementation and Analysis." Sandia National Laboratories, SAND2012-2389. <https://doi.org/10.2172/1039404>

[^reda2008]: Reda and Andreas. 2008. "Solar Position Algorithm for Solar Radiation Applications (Revised)." National Renewable Energy Laboratory, NREL/TP-560-34302. <https://doi.org/10.2172/15003974>
