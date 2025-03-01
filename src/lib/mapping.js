import PopupContent from '../components/Card.svelte';
import { filterObjectByKeySubstring } from './dataWrangling';
import mapboxgl from 'mapbox-gl';

export const updateMarkers = (currentSites, map, markers, currentSummary, specData) => {
  // Validate inputs to prevent errors
  if (!map) return;
  
  // Ensure we have arrays to work with
  if (!Array.isArray(currentSites)) {
    currentSites = [];
  }

  if (!Array.isArray(currentSummary)) {
    currentSummary = [];
  }

  if (!Array.isArray(specData)) {
    specData = [];
  }
  
  // Remove existing markers
  if (markers.length > 0) {
    markers.forEach((marker) => marker.remove());
    markers.length = 0; // Clear the array without creating a new one
  }
  
  // Only proceed if we have valid data
  if (map && currentSites.length > 0 && currentSummary.length > 0) {
    try {
      currentSites.forEach((site) => {
        // Skip invalid site data
        if (!site.site || !site.descriptions || !site.menu || 
            !site.hours || !site.salsa || !site.protein) {
          console.warn('Skipping site with missing data:', site.est_id);
          return;
        }
        
        try {
          // Get menu and protein percentages
          const menuPercs = filterObjectByKeySubstring(site.menu, "perc");
          const proteinPercs = filterObjectByKeySubstring(site.protein, "perc");

          // Get hours
          const startHours = filterObjectByKeySubstring(site.hours, "start");
          const endHours = filterObjectByKeySubstring(site.hours, "end");

          // Get summary values with fallbacks
          const maxSalsaNum = currentSummary[0]?.max_salsa_num || 0;
          const avgSalsaNum = currentSummary[0]?.avg_salsa_num || 0;

          const marker = new mapboxgl.Marker()
            .setLngLat([site.site.lon_1, site.site.lat_1])
            .setPopup(
              new mapboxgl.Popup()
                .setDOMContent(
                  createPopupContent({
                    name: site.site.name,
                    type: site.site.type,
                    shortDescription: site.descriptions.short_descrip,
                    longDescription: site.descriptions.long_descrip,
                    menuItems: menuPercs, 
                    startHours: startHours, 
                    endHours: endHours, 
                    heatOverall: site.salsa.heat_overall,
                    menuProtein: proteinPercs, 
                    salsaCount: site.salsa.total_num, 
                    maxSalsaNum: maxSalsaNum, 
                    avgSalsaNum: avgSalsaNum,
                    tortillaType: site.menu.flour_corn, 
                    specialtyData: specData
                  })
                )
            )
            .addTo(map);

          // Adjust popup position on open
          marker.getPopup().on('open', () => {
            adjustPopupPosition(marker.getPopup(), map);
          });

          markers.push(marker);
        } catch (error) {
          console.error(`Error creating marker for site ${site?.est_id}:`, error);
        }
      });
    } catch (error) {
      console.error('Error updating markers:', error);
    }
  }
};

function createPopupContent(data) {
  try {
    const popupElement = document.createElement('div');
    new PopupContent({
      target: popupElement,
      props: { data },
    });
    return popupElement;
  } catch (error) {
    console.error('Error creating popup content:', error);
    const errorElement = document.createElement('div');
    errorElement.textContent = 'Error loading content';
    return errorElement;
  }
}

function adjustPopupPosition(popup, map) {
  try {
    const popupElement = popup._content;
    const mapContainer = map.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();

    // Get popup position relative to the map
    const popupLeft = popupRect.left - mapRect.left;
    const popupTop = popupRect.top - mapRect.top;

    // Adjust the popup position if it's off the screen
    let offsetX = 0;
    let offsetY = 0;

    if (popupLeft < 0) {
      offsetX = -popupLeft;
    } else if (popupLeft + popupRect.width > mapRect.width) {
      offsetX = mapRect.width - (popupLeft + popupRect.width);
    }

    if (popupTop < 0) {
      offsetY = -popupTop;
    } else if (popupTop + popupRect.height > mapRect.height) {
      offsetY = mapRect.height - (popupTop + popupRect.height);
    }

    popup.setOffset([offsetX, offsetY]);
  } catch (error) {
    console.error('Error adjusting popup position:', error);
  }
}