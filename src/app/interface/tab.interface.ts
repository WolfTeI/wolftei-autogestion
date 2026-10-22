export interface Tab {
    tab: string;
    img: string;
    contenidoTab: ContenidoTab[];
    
  }
  export interface ContenidoTab {
    titulo: string;
    contenido: string;
    img?: string;
  }



