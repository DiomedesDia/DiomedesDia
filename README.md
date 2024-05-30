class Contacto <<interface>> {
  - nombre: String
  - telefono: String
  - correo: String
   
  + getCorreo(): String
  + setCorreo(String correo): void
  + getNombre(): String
  + setNombre(String nombre): void
  + getTelefono(): String
  + setTelefono(String telefono): void
  + toString(): String
}

class Agenda {
  - contactos: List<Contacto>
   
  + agregarContacto(Contacto contacto): void
  + eliminarContacto(Contacto contacto): void
  + buscarContacto(String nombre): Contacto
  + editarContacto(Contacto contacto): void
  + listarContactos(): List<Contacto>
}

Contacto "1" *-- "1" Agenda
