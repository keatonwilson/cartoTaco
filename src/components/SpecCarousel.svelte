<script>
    import { Carousel } from 'flowbite-svelte';

    const images = [
    {
      alt: 'Cosmic timetraveler',
      src: 'https://placehold.co/50',
      title: 'cool test'
    }];

  </script>
  
  <div class="max-w-2xl max-h-6">
    <Carousel {images} duration="3000" />
  </div>