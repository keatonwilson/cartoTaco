import PopupContent from '../components/Card.svelte';
import mapboxgl from 'mapbox-gl';
import { selectedSite } from './stores';

export const updateMarkers = (processedSites, map, markers, summaryStats) => {
  // Validate inputs to prevent errors
  if (!map) return;
  
  // Ensure we have arrays to work with
  if (!Array.isArray(processedSites)) {
    processedSites = [];
  }
  
  // Remove existing markers
  if (markers.length > 0) {
    markers.forEach((marker) => marker.remove());
    markers.length = 0; // Clear the array without creating a new one
  }
  
  // Only proceed if we have valid data
  if (map && processedSites.length > 0) {
    try {
      processedSites.forEach((site) => {
        // Skip invalid site data
        if (!site) {
          return;
        }
        
        try {
          const marker = new mapboxgl.Marker()
            .setLngLat([site.longitude, site.latitude])
            .addTo(map);
          
          // Create popup but don't set it yet - we'll set it on click
          const popup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true
          }).setDOMContent(
            createPopupContent(site.est_id)
          );
          
          // Handle marker click - update selected site
          marker.getElement().addEventListener('click', () => {
            // Set the selected site in the store
            selectedSite.set(site);
            
            // Set and open the popup
            marker.setPopup(popup);
            popup.addTo(map);
            
            // Adjust popup position
            adjustPopupPosition(popup, map);
          });
          
          // Adjust popup position on open
          popup.on('open', () => {
            adjustPopupPosition(popup, map);
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

function createPopupContent(siteId) {
  try {
    const popupElement = document.createElement('div');
    new PopupContent({
      target: popupElement,
      props: { siteId }
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