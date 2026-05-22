#include "VelaGameMode.h"

#include "VelaHeroCharacter.h"

AVelaGameMode::AVelaGameMode()
{
    DefaultPawnClass = AVelaHeroCharacter::StaticClass();
}
