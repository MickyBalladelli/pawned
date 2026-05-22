using UnrealBuildTool;
using System.Collections.Generic;

public class VelaUnrealClientTarget : TargetRules
{
    public VelaUnrealClientTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V6;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("VelaUnrealClient");
    }
}
